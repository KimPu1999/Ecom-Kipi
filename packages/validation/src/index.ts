import { z } from 'zod'

export const emailSchema = z.string().trim().email('Enter a valid email address.')
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
    email: emailSchema,
    phone: z.string().trim().optional(),
    password: passwordSchema,
    password_confirmation: z.string(),
  })
  .refine((values) => values.password === values.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password_confirmation'],
  })

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: emailSchema,
  phone: z.string().trim().nullable().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ProfileInput = z.infer<typeof profileSchema>
