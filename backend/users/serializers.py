from rest_framework import serializers
from .models import User
from sections.serializers import SubsectionSerializer


class UserSerializer(serializers.ModelSerializer):
    sections_list = serializers.SerializerMethodField()
    subsection_detail = SubsectionSerializer(source='subsection', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'sections', 'sections_list', 'subsection', 'subsection_detail', 'is_active']
        read_only_fields = ['id']

    def get_sections_list(self, obj):
        """Return list of section names for DAG"""
        if obj.role == 'DAG':
            return [{'id': s.id, 'name': s.name} for s in obj.sections.all()]
        elif obj.subsection:
            return [{'id': obj.subsection.section.id, 'name': obj.subsection.section.name}]
        return []


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    sections = serializers.PrimaryKeyRelatedField(many=True, queryset=User._meta.get_field('sections').related_model.objects.all(), required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'full_name', 'role', 'sections', 'subsection', 'is_active']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password')
        sections = validated_data.pop('sections', [])
        user = User.objects.create(**validated_data)
        user.set_password(password)
        if sections:
            user.sections.set(sections)
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
        """Display sections for DAG or subsection's section for SrAO/AAO"""
        if obj.role == 'DAG':
            return ', '.join([s.name for s in obj.sections.all()]) or '-'
        elif obj.subsection:
            return obj.subsection.section.name
        return '-'
