import { GlobeLoader } from "@/components/globe/globe-loader";

export const metadata = {
  title: "Explorar no globo",
  description: "Explore a Terra em 3D e encontre profissionais com atendimento presencial perto de qualquer lugar.",
  alternates: { canonical: "/explorar" },
};

export default function Explorar() {
  return <GlobeLoader />;
}
