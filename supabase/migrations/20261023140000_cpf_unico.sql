-- Motoristas entram com o CPF, então ele não pode se repetir dentro da empresa.
create unique index usuario_empresa_cpf_idx on usuario (empresa_id, cpf) where cpf is not null;
