-- Opção da empresa: mostrar a logo como marca d'água no painel e no app.
alter table empresa add column if not exists marca_dagua boolean not null default false;

select nome, marca_dagua from empresa;
