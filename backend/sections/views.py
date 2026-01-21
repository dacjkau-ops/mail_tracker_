from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Section
from .serializers import SectionSerializer


class SectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for sections"""
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]
