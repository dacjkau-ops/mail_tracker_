import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserMinimalSerializer

logger = logging.getLogger(__name__)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom serializer to include user data in token response"""
    def validate(self, attrs):
        username = attrs.get('username', '')
        logger.info(f"Login attempt for user: {username}")

        try:
            data = super().validate(attrs)
            # Fetch user with prefetched sections for proper M2M serialization
            user = User.objects.prefetch_related('sections').select_related(
                'subsection', 'subsection__section'
            ).get(pk=self.user.pk)
            user_serializer = UserSerializer(user)
            data['user'] = user_serializer.data
            logger.info(f"Login successful for user: {username}")
            return data
        except Exception as e:
            logger.warning(f"Login failed for user: {username} - {str(e)}")
            raise


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token view that includes user data"""
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True).prefetch_related('sections').select_related('subsection', 'subsection__section')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action == 'list_minimal':
            return UserMinimalSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by role if requested
        role = self.request.query_params.get('role', None)
        if role:
            queryset = queryset.filter(role=role)

        # Filter by section if requested (for DAG managing multiple sections)
        section = self.request.query_params.get('section', None)
        if section:
            queryset = queryset.filter(sections=section)

        # Filter by subsection if requested (for SrAO/AAO)
        subsection = self.request.query_params.get('subsection', None)
        if subsection:
            queryset = queryset.filter(subsection=subsection)

        return queryset

    @action(detail=False, methods=['get'])
    def list_minimal(self, request):
        """Return minimal user info for dropdowns"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Return current logged-in user's info"""
        user = User.objects.prefetch_related('sections').select_related(
            'subsection', 'subsection__section'
        ).get(pk=request.user.pk)
        serializer = UserSerializer(user)
        return Response(serializer.data)
