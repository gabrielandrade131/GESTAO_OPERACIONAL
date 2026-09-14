from django import template
from GO.models import Pessoa, Funcao

register = template.Library()

@register.simple_tag
def get_pessoas():
    try:
        return Pessoa.objects.filter(ativo=True)
    except Exception:
        return []

@register.simple_tag
def get_funcoes():
    try:
        return Funcao.objects.filter(ativo=True).order_by('nome')
    except Exception:
        return []
