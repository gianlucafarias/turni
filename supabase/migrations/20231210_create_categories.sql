-- Create the categories table
create table if not exists public.categories (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    description text,
    store_id uuid references public.stores(id) on delete cascade not null
);

-- Enable RLS
alter table public.categories enable row level security;

-- Create policies
create policy "Enable all operations for authenticated users"
    on public.categories
    for all
    using (
        exists (
            select 1 from public.stores
            where id = categories.store_id
            and user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.stores
            where id = categories.store_id
            and user_id = auth.uid()
        )
    ); 