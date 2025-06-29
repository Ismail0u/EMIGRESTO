# monapp/serializers/reservation_serializer.py
from rest_framework import serializers
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from ..models.reservations import Reservation
from ..models.utilisateur import Utilisateur
from ..models.etudiant import Etudiant
from ..models.jour import Jour
<<<<<<< HEAD
=======
from ..models.periode import Periode
from .etudiant_serializer import EtudiantSerializer
>>>>>>> parent of 23a4dc7c ( Annulation d'une réservation)
from .jour_serializer import JourSerializer
from .periode_serializer import PeriodeSerializer
from ..models.periode import Periode
from .etudiant_serializer import EtudiantSerializer

class ReservationSerializer(serializers.ModelSerializer):
    initiateur     = serializers.StringRelatedField()    # affiche email ou __str__ de Utilisateur
    reservant_pour = EtudiantSerializer(read_only=True)
    jour           = JourSerializer(read_only=True)
    periode        = PeriodeSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'date', 'heure', 'statut',
            'initiateur', 'reservant_pour',
            'jour', 'periode',
        ]
        read_only_fields = fields  # tout en lecture seule
    

class ReservationCreateSerializer(serializers.ModelSerializer):
    # on reçoit les PK, pas les objets nested
    jour            = serializers.PrimaryKeyRelatedField(queryset=Jour.objects.all())
    periode         = serializers.PrimaryKeyRelatedField(queryset=Periode.objects.all())
    reservant_pour  = serializers.PrimaryKeyRelatedField(
        queryset=Reservation._meta.get_field('reservant_pour').related_model.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Reservation
        fields = ['jour', 'periode', 'date', 'heure', 'reservant_pour']

    def validate(self, attrs):
        user = self.context['request'].user
        # Si l'utilisateur n'a pas d'étudiant associé, on ne peut pas réserver
        if not hasattr(user, 'etudiant'):
            raise serializers.ValidationError("L'utilisateur n'est pas un étudiant.")

        # Si aucun bénéficiaire n'est fourni, on réserve pour l'étudiant de l'utilisateur
        reservant = attrs.get('reservant_pour') or user.etudiant
        reservation_date = attrs.get('date')
        reservation_jour = attrs.get('jour') # This is the Jour object (e.g., Lundi, Mardi)
        reservation_periode = attrs.get('periode') # This is the Periode object (e.g., Petit-déjeuner, Déjeuner)

        # Condition 1: Cannot reserve twice for the same day and period on the same date
        if Reservation.objects.filter(
            reservant_pour=reservant,
            jour=reservation_jour,
            periode=reservation_periode,
            date=reservation_date
        ).exists():
            raise serializers.ValidationError(
                "Vous avez déjà une réservation pour ce jour et cette période à cette date."
            )

        # Condition 2: Cannot reserve for the current day, except for Monday before 11 AM
        today = timezone.localdate()
        now = timezone.localtime().time()

        # If reserving for today
        if reservation_date == today:
            # Check if it's Monday and before 11 AM
            # weekday() returns 0 for Monday, 1 for Tuesday, etc.
            if today.weekday() == 0 and now < time(11, 0): # Monday before 11 AM
                pass # Allow reservation
            else:
                raise serializers.ValidationError(
                    "Vous ne pouvez pas réserver pour aujourd'hui, sauf si c'est Lundi avant 11h."
                )
        elif reservation_date < today:
            raise serializers.ValidationError(
                "Vous ne pouvez pas réserver pour une date passée."
            )

        return attrs