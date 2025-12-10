import { productos } from '../data/productos';
import type { ProductData } from '../types';

export const searchProducts = (query: string, filters: SearchFilters = {}): ProductData[] => {
    const searchTerm = query.toLowerCase();
    
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
            producto.ubicacion.toLowerCase().includes(filters.ubicacion.toLowerCase());

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
                new Date(b.fecha || '').getTime() - new Date(a.fecha || '').getTime()
            );
        default:
            return sortedProducts;
    }
}; 