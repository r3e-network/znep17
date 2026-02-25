import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'zNEP-17 Privacy Vault',
  description: 'Neo N3 zNEP-17 Privacy Vault',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
