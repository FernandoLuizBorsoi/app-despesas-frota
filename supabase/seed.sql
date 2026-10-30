-- Dados iniciais: a empresa e as categorias padrão.
-- Troque o nome da empresa antes de rodar. Veículos e usuários são cadastrados depois.

with nova as (
  insert into empresa (nome) values ('Minha Frota') returning id
)
insert into categoria (empresa_id, nome, exige_km, exige_litros, ordem)
select nova.id, c.nome, c.exige_km, c.exige_litros, c.ordem
from nova, (values
  ('Combustível', true, true, 1),
  ('Pedágio', false, false, 2),
  ('Manutenção', true, false, 3),
  ('Triagem', false, false, 4),
  ('Descarga', false, false, 5),
  ('Estacionamento', false, false, 6),
  ('Lavagem', false, false, 7),
  ('Outros', false, false, 8)
) as c (nome, exige_km, exige_litros, ordem);
