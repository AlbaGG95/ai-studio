import { redirect } from "next/navigation";

type Params = { params: { id: string } };

export default function PreviewRedirect({ params }: Params) {
  const target = params.id ? `/play?projectId=${encodeURIComponent(params.id)}` : "/projects";
  redirect(target);
}
