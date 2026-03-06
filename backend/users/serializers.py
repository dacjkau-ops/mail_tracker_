from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, SignupRequest
from sections.serializers import SubsectionSerializer
from sections.models import Section, Subsection


class UserSerializer(serializers.ModelSerializer):
    sections_list = serializers.SerializerMethodField()
    subsection_detail = SubsectionSerializer(source='subsection', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'actual_role', 'is_primary_ag', 'sections', 'sections_list', 'subsection', 'subsection_detail', 'auditor_subsections', 'is_active']
        read_only_fields = ['id']

    def get_sections_list(self, obj):
        """Return list of section names for DAG, auditor, or subsection-based roles"""
        if obj.role == 'DAG':
            return [{'id': s.id, 'name': s.name} for s in obj.sections.all()]
        elif obj.role == 'auditor':
            subs = list(obj.auditor_subsections.select_related('section').all())
            if subs:
                return [
                    {'id': s.section.id, 'name': f"{s.section.name} / {s.name}"}
                    for s in subs
                ]
            if obj.subsection_id:
                return [{'id': obj.subsection.section.id, 'name': f"{obj.subsection.section.name} / {obj.subsection.name}"}]
            return []
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
        fields = ['id', 'username', 'email', 'password', 'full_name', 'role', 'actual_role', 'is_primary_ag', 'sections', 'subsection', 'auditor_subsections', 'is_active']
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
            if user.role == 'auditor' and not user.subsection_id:
                user.subsection = auditor_subsections[0]
        user.save()
        return user


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user info for dropdowns and references"""
    sections_display = serializers.SerializerMethodField()
    subsection_name = serializers.CharField(source='subsection.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'role', 'actual_role', 'sections_display', 'subsection', 'subsection_name']
        read_only_fields = ['id', 'full_name', 'role', 'actual_role', 'sections_display', 'subsection', 'subsection_name']

    def get_sections_display(self, obj):
        """Display sections for DAG, auditor, or subsection's section for SrAO/AAO/clerk"""
        if obj.role == 'DAG':
            return ', '.join([s.name for s in obj.sections.all()]) or '-'
        elif obj.role == 'auditor':
            # Show configured subsections for auditor
            subs = list(obj.auditor_subsections.select_related('section').all())
            if subs:
                return ', '.join([f"{s.section.name}/{s.name}" for s in subs])
            if obj.subsection_id:
                return f"{obj.subsection.section.name}/{obj.subsection.name}"
            return '-'
        elif obj.subsection:
            return obj.subsection.section.name
        return '-'


class UserAssignableSerializer(serializers.ModelSerializer):
    """Lean serializer for assignment dropdowns."""
    subsection_detail = SubsectionSerializer(source='subsection', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'role', 'actual_role',
            'sections', 'subsection', 'subsection_detail'
        ]
        read_only_fields = fields


class SignupRequestCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    section_id = serializers.PrimaryKeyRelatedField(
        source='requested_section',
        queryset=Section.objects.all(),
        required=True
    )
    subsection_id = serializers.PrimaryKeyRelatedField(
        source='requested_subsection',
        queryset=Subsection.objects.select_related('section').all(),
        required=True
    )

    class Meta:
        model = SignupRequest
        fields = [
            'username',
            'email',
            'password',
            'full_name',
            'requested_role',
            'section_id',
            'subsection_id',
        ]

    def validate_email(self, value):
        blocked_domains = {'gmail.com', 'hotmail.com', 'nic.in'}
        domain = value.split('@')[-1].lower().strip()
        if domain in blocked_domains:
            raise serializers.ValidationError('Please use your official office email address.')
        return value

    def validate_requested_role(self, value):
        allowed_roles = {'SrAO', 'AAO', 'auditor', 'clerk'}
        if value not in allowed_roles:
            raise serializers.ValidationError('Signup is allowed only for SrAO, AAO, auditor, and clerk roles.')
        return value

    def validate(self, attrs):
        section = attrs.get('requested_section')
        subsection = attrs.get('requested_subsection')
        username = attrs.get('username')
        email = attrs.get('email')

        if subsection.section_id != section.id:
            raise serializers.ValidationError({'subsection_id': 'Selected subsection does not belong to selected section.'})

        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'username': 'This username is already taken.'})
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'email': 'This email is already registered.'})

        if SignupRequest.objects.filter(username=username, status='pending').exists():
            raise serializers.ValidationError({'username': 'A pending signup request already exists for this username.'})
        if SignupRequest.objects.filter(email=email, status='pending').exists():
            raise serializers.ValidationError({'email': 'A pending signup request already exists for this email.'})

        return attrs

    def create(self, validated_data):
        raw_password = validated_data.pop('password')
        validated_data['password_hash'] = make_password(raw_password)
        return SignupRequest.objects.create(**validated_data)
