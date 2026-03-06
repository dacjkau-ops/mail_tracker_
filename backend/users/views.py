import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from sections.models import Section
from .models import User
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserMinimalSerializer,
    SignupRequestCreateSerializer,
)

logger = logging.getLogger(__name__)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom serializer to include user data in token response"""
    def validate(self, attrs):
        username = attrs.get('username', '')

        try:
            data = super().validate(attrs)
            # One shaped query for serializer fields shown on login response.
            user = User.objects.prefetch_related('sections').select_related(
                'subsection', 'subsection__section'
            ).prefetch_related(
                'auditor_subsections__section'
            ).get(pk=self.user.pk)
            user_serializer = UserSerializer(user)
            data['user'] = user_serializer.data
            return data
        except Exception as e:
            logger.warning(f"Login failed for user: {username} - {str(e)}")
            raise


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom token view that includes user data"""
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True).prefetch_related(
        'sections', 'auditor_subsections__section'
    ).select_related('subsection', 'subsection__section')
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
        ).prefetch_related(
            'auditor_subsections__section'
        ).get(pk=request.user.pk)
        serializer = UserSerializer(user)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """Allow any user to change their password using username + current password."""
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not all([username, current_password, new_password, confirm_password]):
            return Response(
                {'error': 'All fields are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=current_password)
        if user is None:
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        logger.info(f"Password changed successfully for user: {username}")
        return Response(
            {'message': 'Password changed successfully.'},
            status=status.HTTP_200_OK
        )


class SignupView(APIView):
    """Public signup endpoint: creates a pending signup request for superuser approval."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        signup_request = serializer.save()
        logger.info(
            "Signup request created: username=%s role=%s",
            signup_request.username,
            signup_request.requested_role
        )
        return Response(
            {
                'message': 'Signup request submitted successfully. Await superuser approval before login.',
                'status': signup_request.status,
            },
            status=status.HTTP_201_CREATED
        )


class SignupMetadataView(APIView):
    """Public metadata endpoint so signup form can render section/subsection selectors."""
    permission_classes = [AllowAny]

    def get(self, request):
        sections = Section.objects.prefetch_related('subsections').all().order_by('name')
        payload = []
        for section in sections:
            payload.append(
                {
                    'id': section.id,
                    'name': section.name,
                    'subsections': [
                        {'id': sub.id, 'name': sub.name}
                        for sub in section.subsections.all().order_by('name')
                    ],
                }
            )
        roles = [
            {'value': 'SrAO', 'label': 'Senior Audit Officer'},
            {'value': 'AAO', 'label': 'Assistant Audit Officer'},
            {'value': 'auditor', 'label': 'Auditor'},
            {'value': 'clerk', 'label': 'Clerk'},
        ]
        return Response({'roles': roles, 'sections': payload}, status=status.HTTP_200_OK)
