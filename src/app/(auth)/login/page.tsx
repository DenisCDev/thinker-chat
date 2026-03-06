'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeSlash, GithubLogo, ShieldCheck } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Erro ao fazer login', {
        description: error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message,
      })
      setIsLoading(false)
      return
    }

    toast.success('Login realizado com sucesso!')
    router.push('/assistants')
    router.refresh()
  }

  return (
    <Card className="bg-black/40 backdrop-blur-xl border-white/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-white">Faca seu login</CardTitle>
        <CardDescription className="text-white/50">
          Entre com seu email e senha para acessar a plataforma
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlash className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm text-lime hover:text-lime/80 inline-block"
            >
              Esqueceu a senha?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </CardFooter>
      </form>
      <div className="px-6 pb-5 pt-2 flex items-center justify-center gap-2 text-white/40 text-xs">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Projeto open source e seguro —</span>
        <a
          href="https://github.com/DenisCDev/thinker-chat"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors"
        >
          <GithubLogo className="w-3.5 h-3.5" />
          GitHub
        </a>
      </div>
    </Card>
  )
}
