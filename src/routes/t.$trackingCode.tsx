import { createFileRoute } from "@tanstack/react-router";
import { trackQ, TrackView, TrackError } from "./lacak.$token";
export const Route = createFileRoute("/t/$trackingCode")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(trackQ(params.trackingCode)),
  component: ShortTracking,
  errorComponent: TrackError,
  head: () => ({ meta: [{ title: "Lacak Pengiriman | CV MR EXPRESS" }, { name: "robots", content: "noindex" }] }),
});
function ShortTracking() {
  const { trackingCode } = Route.useParams();
  return <TrackView token={trackingCode} />;
}
