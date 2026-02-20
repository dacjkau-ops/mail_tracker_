from rest_framework import serializers
from .models import User
from sections.serializers import SubsectionSerializer
from sections.models import Subsection


class UserSerializer(serializers.ModelSerializer):
    sections_list = serializers.SerializerMethodField()
    subsection_detail = SubsectionSerializer(source='subsection', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'is_primary_ag', 'sections', 'sections_list', 'subsection', 'subsection_detail', 'auditor_subsections', 'is_active']
        read_only_fields = ['id']

    def get_sections_list(self, obj):
        """Return list of section names for DAG, auditor, or subsection-based roles"""
        if obj.role == 'DAG':
            return [{'id': s.id, 'name': s.name} for s in obj.sections.all()]
        elif obj.role == 'auditor':
            return [
                {'id': s.section.id, 'name': f"{s.section.name} / {s.name}"}
                for s in obj.auditor_subsections.select_related('section').all()
            ]
        elif obj.subsection:
            return [{'id': obj.subsection.section.id, 'name': obj.subsection.section.name}]
        return []


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    sections = serializers.PrimaryKeyRelatedField(many=True, queryset=User._meta.get_field('sections').related_model.objects.all(), required=False)
    auditor_subsections = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Subsection.objects.all(),
        required=False
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'full_name', 'role', 'is_primary_ag', 'sections', 'subsection', 'auditor_subsections', 'is_active']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password')
        sections = validated_data.pop('sections', [])
        auditor_subsections = validated_data.pop('auditor_subsections', [])
        if validated_data.get('role') != 'AG':
            validated_data['is_primary_ag'] = False
        user = User.objects.create(**validated_data)
        user.set_password(password)
        if sections:
            user.sections.set(sections)
        if auditor_subsections:
            user.auditor_subsections.set(auditor_subsections)
        user.save()
        return user


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user info for dropdowns and references"""
    sections_display = serializers.SerializerMethodField()
    subsection_name = serializers.CharField(source='subsection.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'role', 'sections_display', 'subsection', 'subsection_name']
        read_only_fields = ['id', 'full_name', 'role', 'sections_display', 'subsection', 'subsection_name']

    def get_sections_display(self, obj):
        """Display sections for DAG, auditor, or subsection's section for SrAO/AAO/clerk"""
        if obj.role == 'DAG':
            return ', '.join([s.name for s in obj.sections.all()]) or '-'
        elif obj.role == 'auditor':
            # Show configured subsections for auditor
            subs = list(obj.auditor_subsections.select_related('section').all())
            if subs:
                return ', '.join([f"{s.section.name}/{s.name}" for s in subs])
            return '-'
        elif obj.subsection:
            return obj.subsection.section.name
        return '-'
