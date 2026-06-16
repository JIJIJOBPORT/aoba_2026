import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const USERS = [
  { id: '1', email: 'yoshida@jobport.cloud', name: '吉田' },
  { id: '2', email: 'job@jobport.cloud', name: '管理者' },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (password !== process.env.AUTH_PASSWORD) return null;
        const user = USERS.find((u) => u.email === email);
        return user ?? null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
