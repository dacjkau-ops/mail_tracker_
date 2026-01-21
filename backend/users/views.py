from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserMinimalSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom serializer to include user data in token response"""
    def validate(self, attrs):
        data = super().validate(attrs)

        # Add user data to the response
        user_serializer = UserSerializer(self.user)
        data['user'] = user_serializer.data

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token view that includes user data"""
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True).select_related('section')
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

        # Filter by section if requested
        section = self.request.query_params.get('section', None)
        if section:
            queryset = queryset.filter(section=section)

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
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
