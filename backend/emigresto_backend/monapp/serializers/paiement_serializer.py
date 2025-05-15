from rest_framework import serializers
from ..models.paiement import Paiement
from .etudiant_serializer import EtudiantSerializer
from .transaction_serializer import TransactionSerializer

class PaiementSerializer(serializers.ModelSerializer):
    etudiant    = EtudiantSerializer(read_only=True)
    transaction = TransactionSerializer(read_only=True)

    class Meta:
        model = Paiement
        fields = ['idPaiement', 'date', 'montant', 'mode_paiement', 'etudiant', 'transaction']
        read_only_fields = ['idPaiement', 'date', 'etudiant', 'transaction']
