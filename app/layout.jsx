import "@/styles/globals.css";

export const metadata = {
  title: "COLE Librería y Papelería",
  description: "Tienda online de COLE Librería y Papelería",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
