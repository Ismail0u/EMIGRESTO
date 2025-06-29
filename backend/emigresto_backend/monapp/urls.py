# backend/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    auth_views, etudiant_views, jour_views, notification_views,
    paiement_views, personnel_views, recu_views,
    reservation_views, ticket_views, transaction_views,
    utilisateur_views, recharge_views, user_details_views, periode_views
)

router = DefaultRouter()
router.register('recharges', recharge_views.RechargeViewSet)
router.register('etudiants', etudiant_views.EtudiantViewSet)
router.register('jours', jour_views.JourViewSet)
router.register('periodes', periode_views.PeriodeViewSet)
router.register('reservations', reservation_views.ReservationViewSet, basename='reservations')
router.register('tickets', ticket_views.TicketViewSet)
router.register('utilisateurs', utilisateur_views.UtilisateurViewSet)

# Enregistrement des profils métiers
router.register(r'magasiniers', personnel_views.MagasinierViewSet)
router.register(r'vendeurtickets', personnel_views.VendeurTicketsViewSet)
router.register(r'responsableguichets', personnel_views.ResponsableGuichetViewSet)
router.register(r'chefservicerestaurant', personnel_views.ChefServiceRestaurantViewSet)
router.register(r'administrateurs', personnel_views.AdministrateurViewSet)

router.register('notifications', notification_views.NotificationViewSet)
router.register('transactions', transaction_views.TransactionViewSet)
router.register('recus', recu_views.RecuTicketViewSet)
router.register('paiements', paiement_views.PaiementViewSet)

urlpatterns = [
    path('api/', include(router.urls)),

    # Auth custom
    path('api/auth/register/', auth_views.RegisterView.as_view(), name='auth-register'),
    path('api/auth/logout/', auth_views.LogoutView.as_view(), name='auth-logout'),

    # JWT endpoints
    path('api/auth/token/', auth_views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', auth_views.CustomTokenRefreshView.as_view(), name='token_refresh'),

    # User details endpoint
    path('api/user-details/', user_details_views.UserDetailsAPIView.as_view(), name='user-details'),
]
