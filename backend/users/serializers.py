from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'section', 'section_name', 'is_active']
        read_only_fields = ['id']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'full_name', 'role', 'section', 'is_active']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user info for dropdowns and references"""
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'role', 'section', 'section_name']
        read_only_fields = ['id', 'full_name', 'role', 'section', 'section_name']
