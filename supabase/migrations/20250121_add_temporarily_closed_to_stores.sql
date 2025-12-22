-- Agregar campo temporarily_closed a stores para cerrar temporalmente el negocio
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS temporarily_closed BOOLEAN DEFAULT false NOT NULL;

-- Comentario para documentar
COMMENT ON COLUMN public.stores.temporarily_closed IS 'Si es true, el negocio está cerrado temporalmente y no se pueden tomar nuevos turnos hasta que se desactive';









