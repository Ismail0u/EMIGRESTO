# monapp/views/reservation_viewset.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, permissions
from monapp.models.reservations import Reservation
from monapp.serializers.reservation_serializer import ReservationSerializer, ReservationCreateSerializer


class ReservationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week   = start_of_week + timedelta(days=6)
        qs = Reservation.objects.filter(date__range=(start_of_week, end_of_week))
        # si c'est un admin ou responsable, on voit tout
        if user.is_staff or user.role == 'RESPONSABLE_GUICHET' or user.role == 'ADMIN':
            return qs.order_by('-date', '-heure')
        # sinon on ne voit que ce qu'on a initié
        return qs.filter(initiateur=user).order_by('-date', '-heure')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ReservationCreateSerializer
        return ReservationSerializer

    def perform_create(self, serializer):

        etudiant = self.request.user.as_etudiant
        serializer.save(etudiant=etudiant)
