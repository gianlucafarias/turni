import { productos } from '../data/productos';
import type { ProductData } from '../types/index';

export const searchProducts = (query: string, filters: SearchFilters = {}): ProductData[] => {
    const searchTerm = query.toLowerCase();

    if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
            fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1',location:'src/utils/search.ts:6',message:'searchProducts called',data:{query,filtersKeys:Object.keys(filters),sampleProducto:productos[0]?.nombre},timestamp:Date.now()})}).catch(()=>{});
        }
    }
    
    return productos.filter(producto => {
        // Búsqueda por texto
        const matchesSearch = !searchTerm || 
            producto.nombre.toLowerCase().includes(searchTerm) ||
            producto.descripcion.toLowerCase().includes(searchTerm) ||
            producto.categoria.toLowerCase().includes(searchTerm);

        // Filtro por estado
        const matchesEstado = !filters.estado || 
            producto.estado === filters.estado;

        // Filtro por precio
        const matchesPrecio = (!filters.precioMin || producto.precio >= filters.precioMin) &&
            (!filters.precioMax || producto.precio <= filters.precioMax);

        // Filtro por ubicación
        const matchesUbicacion = !filters.ubicacion || 
            producto.ubicacion?.toLowerCase().includes(filters.ubicacion.toLowerCase());

        // Filtro por categoría
        const matchesCategoria = !filters.categoria || 
            producto.categoria === filters.categoria;

        return matchesSearch && matchesEstado && matchesPrecio && matchesUbicacion && matchesCategoria;
    });
};

export interface SearchFilters {
    estado?: 'nuevo' | 'usado' | 'reacondicionado';
    precioMin?: number;
    precioMax?: number;
    ubicacion?: string;
    categoria?: string;
}

export const sortProducts = (products: ProductData[], sortBy: string): ProductData[] => {
    const sortedProducts = [...products];
    
    switch (sortBy) {
        case 'precio_asc':
            return sortedProducts.sort((a, b) => a.precio - b.precio);
        case 'precio_desc':
            return sortedProducts.sort((a, b) => b.precio - a.precio);
        case 'fecha_desc':
            // Aquí asumimos que tenemos un campo fecha en los productos
            return sortedProducts.sort((a, b) => 
                new Date((b as any).fecha || '').getTime() - new Date((a as any).fecha || '').getTime()
            );
        default:
            return sortedProducts;
    }
}; 