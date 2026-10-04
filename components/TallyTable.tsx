import { formatWhen } from "@/lib/format";

type OptionRow = {
  id: string;
  startsAt: string;
  label: string | null;
  yes: number;
  maybe: number;
  no: number;
  totalAttendees: number;
};

export default function TallyTable({
  options,
  finalizedOptionId,
}: {
  options: OptionRow[];
  finalizedOptionId?: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2 pr-4">Time</th>
            <th className="px-2">Yes</th>
            <th className="px-2">Maybe</th>
            <th className="px-2">No</th>
            <th className="px-2">Total attending</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => (
            <tr
              key={o.id}
              className={`border-b ${o.id === finalizedOptionId ? "bg-green-50 font-medium" : ""}`}
            >
              <td className="py-2 pr-4">
                {o.label ? `${o.label} — ` : ""}
                {formatWhen(o.startsAt)}
                {o.id === finalizedOptionId && " ✓"}
              </td>
              <td className="px-2">{o.yes}</td>
              <td className="px-2">{o.maybe}</td>
              <td className="px-2">{o.no}</td>
              <td className="px-2">{o.totalAttendees}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
