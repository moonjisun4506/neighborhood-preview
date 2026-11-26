import type {Metadata} from 'next';
import {DesignScreen} from '@/components/design-screen';
export const metadata:Metadata={title:'교통·소음·치안'};
export default function Transport(){return <DesignScreen page="transport"/>;}
