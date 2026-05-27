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

/**
 * Human-friendly field labels for error messages.
 */
const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  passportNumber: "Passport Number",
  passportIssueDate: "Passport Issue Date",
  passportExpiry: "Passport Expiry Date",
  passportIssuingAuthority: "Passport Issuing Authority",
  passportCopyUrl: "Passport Copy",
  profilePhotoUrl: "Profile Photo",
  dateOfBirth: "Date of Birth",
  placeOfBirth: "Place of Birth",
  gender: "Gender",
  nationality: "Nationality",
  ethnicGroup: "Ethnic Group",
  maritalStatus: "Marital Status",
  levelOfStudy: "Level of Study",
  phone: "Phone Number",
  email: "Email Address",
  occupation: "Occupation",
  country: "Country",
  city: "City",
  address: "Address",
  roomPreference: "Room Preference",
  visaNumber: "Visa Number",
  departureCity: "Departure City",
};

/**
 * Validates that all required fields (as configured by admin) have values.
 * Returns a list of missing field names with human-friendly labels.
 */
export function validateRequiredFields(
  fieldConfig: FieldCfgFn,
  formData: Record<string, any>,
  fieldNames: string[],
): { valid: boolean; missingFields: { field: string; label: string }[] } {
  const missingFields: { field: string; label: string }[] = [];

  for (const fieldName of fieldNames) {
    const cfg = fieldConfig(fieldName);
    if (!cfg.visible || !cfg.required) continue;

    const value = formData[fieldName];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      missingFields.push({
        field: fieldName,
        label: FIELD_LABELS[fieldName] || fieldName.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
      });
    }
  }

  return { valid: missingFields.length === 0, missingFields };
}
