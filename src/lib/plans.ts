export const DEFAULT_PLANS = [
    {
        id: 'basico',
        name: 'Básico',
        price: 'Gratis',
        priceNum: 0,
        color: 'from-slate-600 to-slate-800',
        badge: '',
        locations: 0,
        cashiers: 0,
        products: 50,
        includesPos: false,
        highlight: false,
        features: [
            'Perfil público en ModaZapotlanejo',
            'Catálogo mayorista en línea',
            'Soporte estándar por correo'
        ]
    },
    {
        id: 'estandar',
        name: 'Estándar',
        price: '$299/mes',
        priceNum: 299,
        color: 'from-cyan-600 via-blue-700 to-indigo-800',
        badge: '⭐ Ideal Local',
        locations: 2,
        cashiers: 3,
        products: 200,
        includesPos: true,
        highlight: false,
        features: [
            'Punto de Venta (POS) Offline',
            'Cortes de caja y arqueos (Corte Z)',
            'Catálogo sincronizado en línea',
            'Soporte por WhatsApp'
        ]
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$599/mes',
        priceNum: 599,
        color: 'from-indigo-600 via-purple-600 to-pink-700',
        badge: '🚀 El Más Vendido',
        locations: 5,
        cashiers: 10,
        products: 0,
        includesPos: true,
        highlight: true,
        features: [
            'Productos ILIMITADOS',
            'Comisiones automáticas de empleados',
            'Apartados y abonos divididos',
            'Envío de tickets por WhatsApp',
            'Soporte prioritario 24/7'
        ]
    },
    {
        id: 'empresarial',
        name: 'Empresarial',
        price: '$999/mes',
        priceNum: 999,
        color: 'from-amber-600 via-amber-700 to-yellow-800',
        badge: '🏆 Mayoristas Líderes',
        locations: 20,
        cashiers: 50,
        products: 0,
        includesPos: true,
        highlight: false,
        features: [
            'Todo lo del plan Pro',
            'Traspasos rápidos con firma digital',
            'Modo de Prueba (Entrenamiento)',
            'Importador masivo desde Excel',
            'Ejecutivo de cuenta dedicado'
        ]
    }
];
