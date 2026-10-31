"""Validate stdin against the official OpenNavent BR XSD 1.1 schema."""
from pathlib import Path
import sys
import xmlschema

schema = xmlschema.XMLSchema11(
    Path(__file__).resolve().parents[1] / 'tests/fixtures/OpenNaventAvisoBR.xsd'
)
xml = sys.stdin.read()
schema.validate(xml)
print('XML de venda e aluguel válido no XSD oficial OpenNavent BR 1.1.')
