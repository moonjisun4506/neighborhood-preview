import type {Metadata} from 'next';
import {AuthForm} from '@/components/auth-form';
export const metadata:Metadata={title:'로그인'};
export default function Login(){return <div className="auth-page"><AuthForm mode="login"/></div>;}
