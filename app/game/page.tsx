"use client";

import dynamic from 'next/dynamic';

const InstalledGameHome=dynamic(()=>import('@/components/InstalledGameHome'),{ssr:false});

export default function GameHome(){
 return <InstalledGameHome/>;
}
