from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Section, Subsection
from .serializers import SectionSerializer, SubsectionSerializer


class SectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for sections"""
    queryset = Section.objects.prefetch_related('subsections').all()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]


class SubsectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for subsections"""
    queryset = Subsection.objects.select_related('section').all()
    serializer_class = SubsectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by section if requested
        section = self.request.query_params.get('section', None)
        if section:
            queryset = queryset.filter(section=section)
        return queryset
