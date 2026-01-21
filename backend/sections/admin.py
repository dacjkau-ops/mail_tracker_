from django.contrib import admin
from .models import Section


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']
