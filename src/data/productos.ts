export interface Categoria {
    id: number;
    nombre: string;
    icono: string;
    color?: string;
}

export interface Producto {
    id: number;
    nombre: string;
    precio: number;
    precioAnterior?: number;
    imagen: string;
    categoria: string;
    descripcion: string;
    etiqueta?: string;
    stock: number;
    destacado: boolean;
    valoracion: number;
    numResenas: number;
    caracteristicas: string[];
    ubicacion?: string;
    estado?: 'nuevo' | 'usado' | 'reacondicionado';
    fecha?: string;
}

export const categorias: Categoria[] = [
    { id: 1, nombre: "Electrónicos", icono: "💻", color: "bg-blue-50" },
    { id: 2, nombre: "Ropa", icono: "👕", color: "bg-pink-50" },
    { id: 3, nombre: "Hogar", icono: "🏠", color: "bg-green-50" },
    { id: 4, nombre: "Deportes", icono: "⚽", color: "bg-orange-50" },
];

export const productos: Producto[] = [
    {
        id: 1,
        nombre: "Smartphone XYZ Pro",
        precio: 599.99,
        precioAnterior: 699.99,
        imagen: "https://picsum.photos/seed/1/800/600",
        categoria: "Electrónicos",
        descripcion: "El último smartphone con características premium y rendimiento excepcional.",
        etiqueta: "Nuevo",
        stock: 15,
        destacado: true,
        valoracion: 4.5,
        numResenas: 128,
        caracteristicas: [
            "Pantalla AMOLED 6.5\"",
            "Cámara 108MP",
            "Batería 5000mAh"
        ]
    },
    {
        id: 2,
        nombre: "Zapatillas Running Pro",
        precio: 89.99,
        imagen: "https://picsum.photos/seed/2/800/600",
        categoria: "Deportes",
        descripcion: "Zapatillas profesionales para running con máxima comodidad.",
        stock: 25,
        destacado: true,
        valoracion: 4.8,
        numResenas: 89,
        caracteristicas: [
            "Suela anti-impacto",
            "Material transpirable",
            "Peso ligero"
        ]
    },
];

export const getProductosPorCategoria = (categoria: string) => {
    return productos.filter(producto => producto.categoria === categoria);
};

export const getProductosDestacados = () => {
    return productos.filter(producto => producto.destacado);
};

export const getProductoPorId = (id: number) => {
    return productos.find(producto => producto.id === id);
};

export const buscarProductos = (query: string) => {
    const searchTerm = query.toLowerCase();
    return productos.filter(producto => 
        producto.nombre.toLowerCase().includes(searchTerm) ||
        producto.descripcion.toLowerCase().includes(searchTerm) ||
        producto.categoria.toLowerCase().includes(searchTerm)
    );
}; 