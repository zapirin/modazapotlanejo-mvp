import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigimos temporalmente a la ruta del Seller Center que acabamos de construir.
  // En el futuro, aquí irá el Home B2C público.
  redirect('/seller-center/dashboard');
}
