from django.contrib import admin
from .models import Section, Subsection


class SubsectionInline(admin.TabularInline):
    model = Subsection
    extra = 1
    fields = ['name', 'description']


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'directly_under_ag', 'description', 'created_at']
    list_filter = ['directly_under_ag']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']
    inlines = [SubsectionInline]


@admin.register(Subsection)
class SubsectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'section', 'description', 'created_at']
    list_filter = ['section']
    search_fields = ['name', 'description', 'section__name']
    readonly_fields = ['created_at']
