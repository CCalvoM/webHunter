import { supabase } from './supabase'

export async function redirectToCheckout(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: {} })
  if (error) throw new Error(error.message ?? 'Error al crear sesión de pago')
  if (!data?.url) throw new Error('No se recibió URL de pago')
  window.location.href = data.url
}

export async function redirectToPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('customer-portal', { body: {} })
  if (error) throw new Error(error.message ?? 'Error al abrir el portal de facturación')
  if (!data?.url) throw new Error('No se recibió URL del portal')
  window.location.href = data.url
}
