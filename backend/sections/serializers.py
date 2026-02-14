from rest_framework import serializers
from .models import Section, Subsection


class SubsectionSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = Subsection
        fields = ['id', 'name', 'description', 'section', 'section_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class SectionSerializer(serializers.ModelSerializer):
    subsections = SubsectionSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'name', 'description', 'directly_under_ag', 'subsections', 'created_at']
        read_only_fields = ['id', 'created_at']
