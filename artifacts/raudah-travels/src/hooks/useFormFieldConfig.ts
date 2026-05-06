import { useQuery } from "@tanstack/react-query";

interface FormFieldSetting {
  id: string;
  fieldName: string;
  enabled: boolean;
  required: boolean;
}

export type FieldCfgFn = (fieldName: string) => { visible: boolean; required: boolean };

export function useFormFieldConfig(): FieldCfgFn {
  const { data } = useQuery<{ fields: FormFieldSetting[] }>({
    queryKey: ["admin-booking-form-fields"],
    queryFn: () => fetch("/api/public/booking-form-fields").then(r => r.json()),
    staleTime: 60_000,
  });

  const map = new Map<string, FormFieldSetting>();
  for (const f of data?.fields ?? []) {
    map.set(f.fieldName, f);
  }

  return (fieldName: string): { visible: boolean; required: boolean } => {
    const f = map.get(fieldName);
    if (!f) return { visible: true, required: false };
    return { visible: f.enabled, required: f.required };
  };
}
