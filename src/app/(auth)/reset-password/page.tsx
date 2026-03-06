'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { CircleNotch, CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        console.error('Error updating password:', error)
        toast.error(error.message || 'Erro ao redefinir senha. Tente novamente.')
        return
      }

      setSuccess(true)
      toast.success('Senha redefinida com sucesso!')
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('Erro ao redefinir senha. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-emerald-400" />
          </div>
          <CardTitle className="text-white">Senha redefinida!</CardTitle>
          <CardDescription className="text-white/50">
            Sua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">Ir para o login</Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Reset form
  return (
    <Card className="bg-black/40 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Criar nova senha</CardTitle>
        <CardDescription className="text-white/50">
          Digite sua nova senha abaixo
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleResetPassword}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirme sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A senha deve ter pelo menos 6 caracteres
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                Redefinindo...
              </>
            ) : (
              'Redefinir senha'
            )}
          </Button>
          <Link
            href="/login"
            className="text-sm text-center text-emerald-400 hover:text-emerald-300"
          >
            Voltar para o login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

function LoadingFallback() {
  return (
    <Card className="bg-black/40 backdrop-blur-xl border-white/10">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CircleNotch className="h-8 w-8 animate-spin text-emerald-400 mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
