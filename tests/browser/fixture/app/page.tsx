import { PropertyForm } from "../../../../components/admin/PropertyForm";
import { rejectSave } from "./reject-save";

const cities = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Cidade 1" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Cidade 2" },
];

export default function Page() {
  return (
    <PropertyForm
      action={rejectSave}
      cities={cities}
      neighborhoods={[
        {
          id: "33333333-3333-4333-8333-333333333333",
          city_id: cities[0].id,
          name: "Bairro 1",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          city_id: cities[1].id,
          name: "Bairro 2",
        },
      ]}
      submitLabel="Salvar teste"
    />
  );
}
