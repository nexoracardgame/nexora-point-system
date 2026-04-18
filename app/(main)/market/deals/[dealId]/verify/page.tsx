import VerifySaleForm from "./verify-form";

export default async function VerifyDealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;

  return <VerifySaleForm dealId={dealId} />;
}