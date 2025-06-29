// src/hooks/useReservationsData.js (Exemple de construction de reservationsMap)

import { useState, useEffect, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import { API } from "../services/apiService"; // Assurez-vous que le chemin est correct

const useReservationsData = () => {
  const [etudiants, setEtudiants] = useState([]);
  const [jours, setJours] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [reservationsBrutes, setReservationsBrutes] = useState([]); // Nouveau: pour stocker les données brutes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState(null);
  const [page, setPage] = useState(1);
  const rowsPerPage = 7; // Vous pouvez ajuster cela

  // Dates pour la semaine courante, calculées dynamiquement
  const getReservationDate = useCallback((jourId) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 pour Dimanche, 1 pour Lundi, etc.
    const currentDayId = dayOfWeek === 0 ? 7 : dayOfWeek; // Adapter pour Jours: 1=Lun, 7=Dim

    // Calculer le décalage pour atteindre le jour de la semaine correspondant à jourId
    // Par exemple, si aujourd'hui est Mardi (ID 2) et jourId est Jeudi (ID 4), le décalage est +2.
    // Si aujourd'hui est Vendredi (ID 5) et jourId est Lundi (ID 1), le décalage est 1 - 5 = -4,
    // puis +7 pour la semaine suivante = +3.
    let diff = jourId - currentDayId;
    if (diff < 0) {
      diff += 7; // Si le jour est passé cette semaine, prendre celui de la semaine prochaine
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    // Retourne la date au format YYYY-MM-DD
    return targetDate.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [etuRes, jourRes, periRes, resaRes] = await Promise.all([
          API.etudiant.list({ page_size: 500 }),
          API.jour.list({ page_size: 7 }),
          API.periode.list({ page_size: 50 }),
          API.reservation.list({ page_size: 1000,}),// Récupérer toutes les réservations
        ]);

        setEtudiants(etuRes.results);
        setJours(jourRes.results.sort((a, b) => a.id - b.id)); // S'assurer que les jours sont triés par ID
        setPeriodes(periRes.results.sort((a, b) => a.id - b.id)); // S'assurer que les périodes sont triées par ID
        setReservationsBrutes(resaRes.results); // Stocker les réservations brutes
      } catch (err) {
        console.error("Erreur lors du chargement des données :", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []); // Dépendances vides pour un seul chargement au montage

  // --- Logique de traitement des réservations pour la Map ---
  const reservationsMap = useMemo(() => {
    const map = new Map();
    reservationsBrutes.forEach((r) => {
      // Pour la date de la réservation, nous utilisons la date réelle de la réservation
      // et la comparons avec la date calculée pour la semaine actuelle
      const reservationDate = new Date(r.date);
      reservationDate.setHours(0, 0, 0, 0);

      const targetJourDate = new Date(getReservationDate(r.jour.id));
      targetJourDate.setHours(0, 0, 0, 0);

      // Si la réservation correspond au jour de la semaine *actuelle*
      // C'est ici que se fait la magie pour n'afficher que les réservations de la semaine en cours.
      // Assurez-vous que les IDs de jour correspondent aux IDs de la base de données (1=Lundi, etc.)
      if (
        r.jour.id &&
        r.periode.id &&
        r.etudiant?.id &&
        reservationDate.getTime() === targetJourDate.getTime()
      ) {
        if (!map.has(r.etudiant.id)) {
          map.set(r.etudiant.id, new Map());
        }
        const studentReservations = map.get(r.etudiant.id);
        studentReservations.set(`${r.jour.id}-${r.periode.id}`, r); // Stocke l'objet réservation entier si nécessaire
      }
    });
    return map;
  }, [reservationsBrutes, getReservationDate]); // Recalculer quand les réservations brutes ou les dates des jours changent

  // --- Logique de filtrage et tri ---
  const filteredEtudiants = useMemo(() => {
    if (!searchTerm) return etudiants;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return etudiants.filter(
      (e) =>
        e.nom.toLowerCase().includes(lowerCaseSearchTerm) ||
        e.prenom.toLowerCase().includes(lowerCaseSearchTerm) ||
        String(e.id).includes(lowerCaseSearchTerm) ||
        e.matricule?.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [etudiants, searchTerm]);

  const sortedEtudiants = useMemo(() => {
    if (!sortBy) return filteredEtudiants;
    return [...filteredEtudiants].sort((a, b) => {
      // Adapter ici si vos clés de tri sont différentes
      if (sortBy === "idEtudiant") return a.id - b.id;
      if (sortBy === "nomEtudiant")
        return a.nom.localeCompare(b.nom, undefined, { sensitivity: "base" });
      if (sortBy === "prenomEtudiant")
        return a.prenom.localeCompare(b.prenom, undefined, {
          sensitivity: "base",
        });
      return 0;
    });
  }, [filteredEtudiants, sortBy]);

  const paginatedEtudiants = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedEtudiants.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedEtudiants, page, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(sortedEtudiants.length / rowsPerPage);
  }, [sortedEtudiants]);

  // --- Logique de toggle pour les réservations ---
  const toggleReservation = useCallback(
    async (etudiantId, jourId, periodeId) => {
      const currentReservationsForStudent =
        reservationsMap.get(etudiantId) || new Map();
      const key = `${jourId}-${periodeId}`;
      const existingReservation = currentReservationsForStudent.get(key);

      const reservationDate = getReservationDate(jourId); // La date spécifique du jour de la semaine

      try {
        if (existingReservation) {
          // Annuler la réservation existante
          await API.reservation.delete(existingReservation.id);
          // Mettre à jour l'état local après suppression
          setReservationsBrutes((prev) =>
            prev.filter((r) => r.id !== existingReservation.id)
          );
          toast.success("Réservation annulée !");
        } else {
          // Créer une nouvelle réservation
          const newReservationData = {
            etudiant: etudiantId, // C'est l'ID de l'étudiant
            jour: jourId,
            periode: periodeId,
            date: reservationDate,
            heure: "12:00:00", // Ou une heure par défaut si non pertinente
            statut: "VALIDE",
          };
          const resp = await API.reservation.create(newReservationData);
          // Mettre à jour l'état local après création
          setReservationsBrutes((prev) => [...prev, resp]); // Assurez-vous que `resp` contient l'objet réservation complet
          toast.success("Réservation effectuée !");
        }
      } catch (err) {
        console.error("Erreur lors de la mise à jour de la réservation :", err);
        toast.error(
          "Erreur: " +
            (err.response?.data?.detail ||
              err.response?.data?.non_field_errors?.[0] ||
              err.message ||
              "Une erreur est survenue.")
        );
      }
    },
    [reservationsMap, getReservationDate]
  );

  const toggleAllForStudent = useCallback(
    async (etudiantId) => {
      const studentReservations = reservationsMap.get(etudiantId) || new Map();
      const allChecked = jours.every((jour) =>
        periodes.every((periode) =>
          studentReservations.has(`${jour.id}-${periode.id}`)
        )
      );

      // Récupérer la date actuelle pour le jour de la semaine
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const actions = []; // Pour stocker les promesses de suppression/création

      for (const jour of jours) {
        const dateForJour = new Date(getReservationDate(jour.id));
        dateForJour.setHours(0, 0, 0, 0);
        const isPast = dateForJour < today;

        if (isPast) continue; // Ne pas modifier les réservations passées

        for (const periode of periodes) {
          const key = `${jour.id}-${periode.id}`;
          const existingReservation = studentReservations.get(key);

          if (allChecked && existingReservation) {
            // Tout est coché, donc on décoche tout (supprime)
            actions.push(API.reservation.delete(existingReservation.id));
          } else if (!allChecked && !existingReservation) {
            // Pas tout coché, on coche tout (crée)
            actions.push(
              API.reservation.create({
                reservant_pour: etudiantId,
                jour: jour.id,
                periode: periode.id,
                date: getReservationDate(jour.id), // Date spécifique pour ce jour
                heure: "12:00:00",
                statut: "VALIDE",
              })
            );
          }
        }
      }

      try {
        await Promise.all(actions);
        // Après toutes les opérations, rafraîchir les données brutes
        const resaRes = await API.reservation.list({ page_size: 1000 });
        setReservationsBrutes(resaRes.results);
        toast.success("Mise à jour des réservations réussie !");
      } catch (err) {
        console.error("Erreur lors du basculement des réservations :", err);
        toast.error(
          "Erreur: " +
            (err.response?.data?.detail ||
              err.response?.data?.non_field_errors?.[0] ||
              err.message ||
              "Une erreur est survenue.")
        );
      }
    },
    [reservationsMap, jours, periodes, getReservationDate]
  );

  const exportToPDF = useCallback(() => {
    const pdf = new jsPDF("landscape")
    pdf.text("Liste des Réservations", 14, 10)
  
    // En-tête du tableau : ID, nom, prénom + chaque jour
    const head = [
      ["ID", "Nom", "Prénom", ...jours.map((j) => j.nomJour)]
    ]
  
    // Corps du tableau
    const body = sortedEtudiants.map((e) => {
      const row = [e.id, e.nom, e.prenom]
  
      jours.forEach((j) => {
        let s = ""
        periodes.forEach((p) => {
          const key = `${j.id}-${p.id}`; // Clé correcte pour la map de l'étudiant
          const isReserved = reservationsMap.get(e.id)?.has(key);
          s += isReserved ? "✔ " : "✘ ";

        });
        row.push(s.trim());
      });
      return row;
    });
    autoTable(pdf, {
          head,
          body,
          startY: 20,});
    pdf.save("Reservations.pdf");
  }, [sortedEtudiants, jours, periodes, reservationsMap]);

  const handleKeyDown = useCallback(
    (e, etudiantId, jourId, periodeId) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); // Empêche le défilement de la page avec la barre d'espace
        toggleReservation(etudiantId, jourId, periodeId);
      }
    },
    [toggleReservation]
  );

  return {
    etudiants: paginatedEtudiants,
    jours,
    periodes,
    reservationsMap,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    page,
    totalPages,
    setPage,
    exportToPDF,
    toggleReservation,
    toggleAllForStudent,
    handleKeyDown,
    getReservationDate,
  };
};

export default useReservationsData;