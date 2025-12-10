export const CONFIG = {
    whatsappNumber: "5491112345678",
    maxImageSize: 10 * 1024 * 1024, // 10MB
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
    baseUrl: 'https://tudominio.com',
    publicationSteps: [
        { id: 1, name: 'Información del Producto', description: 'Detalles y características' },
        { id: 2, name: 'Plan de Publicación', description: 'Elige tu plan' },
        { id: 3, name: 'Pago y Publicación', description: 'Finaliza tu publicación' }
    ],
    publicationPlans: [
        {
            id: 'basico',
            nombre: 'Básico',
            precio: 999,
            duracion: '30 días',
            caracteristicas: [
                'Publicación por 30 días',
                'Hasta 3 fotos',
                'Visibilidad estándar'
            ]
        },
        {
            id: 'premium',
            nombre: 'Premium',
            precio: 1999,
            duracion: '30 días',
            destacado: true,
            caracteristicas: [
                'Publicación por 30 días',
                'Hasta 10 fotos',
                'Producto destacado',
                'Mejor visibilidad',
                'Estadísticas de visitas'
            ]
        },
        {
            id: 'profesional',
            nombre: 'Profesional',
            precio: 4999,
            duracion: '90 días',
            caracteristicas: [
                'Publicación por 90 días',
                'Fotos ilimitadas',
                'Producto destacado',
                'Máxima visibilidad',
                'Estadísticas avanzadas',
                'Soporte prioritario'
            ]
        }
    ],
    categorias: [
        { 
            id: 1, 
            nombre: "Electrónicos", 
            icono: "💻", 
            color: "bg-blue-50",
            subcategorias: [
                "Celulares",
                "Computadoras",
                "Tablets",
                "Audio",
                "Accesorios"
            ]
        },
        { 
            id: 2, 
            nombre: "Hogar", 
            icono: "🏠", 
            color: "bg-green-50",
            subcategorias: [
                "Muebles",
                "Electrodomésticos",
                "Decoración",
                "Jardín",
                "Herramientas"
            ]
        },
        { 
            id: 3, 
            nombre: "Vehículos", 
            icono: "🚗", 
            color: "bg-red-50",
            subcategorias: [
                "Autos",
                "Motos",
                "Bicicletas",
                "Repuestos",
                "Accesorios"
            ]
        },
        { 
            id: 4, 
            nombre: "Moda", 
            icono: "👕", 
            color: "bg-pink-50",
            subcategorias: [
                "Ropa",
                "Calzado",
                "Accesorios",
                "Relojes",
                "Joyas"
            ]
        },
        { 
            id: 5, 
            nombre: "Deportes", 
            icono: "⚽", 
            color: "bg-orange-50",
            subcategorias: [
                "Equipamiento",
                "Ropa deportiva",
                "Calzado deportivo",
                "Suplementos",
                "Accesorios"
            ]
        },
        { 
            id: 6, 
            nombre: "Inmuebles", 
            icono: "🏢", 
            color: "bg-purple-50",
            subcategorias: [
                "Departamentos",
                "Casas",
                "Terrenos",
                "Oficinas",
                "Cocheras"
            ]
        }
    ]
}; 