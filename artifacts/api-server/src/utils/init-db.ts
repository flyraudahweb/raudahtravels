import { db } from "@workspace/db";
import { chatChannelsTable, bookingFormFieldsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function ensureDefaultData() {
  // 1. Ensure default chat channels exist
  const existingChannels = await db.select({ count: sql<number>`count(*)` }).from(chatChannelsTable);
  if (Number(existingChannels[0]?.count) === 0) {
    console.log("Seeding default chat channels...");
    await db.insert(chatChannelsTable).values([
      { name: "General", slug: "general", description: "General team communication", isDefault: true },
      { name: "Announcements", slug: "announcements", description: "Important updates and announcements", isDefault: true },
      { name: "Support", slug: "support", description: "Agent and client support", isDefault: true },
    ]);
  }

  // 2. Ensure default booking form fields exist
  const existingFields = await db.select({ count: sql<number>`count(*)` }).from(bookingFormFieldsTable);
  if (Number(existingFields[0]?.count) === 0) {
    console.log("Seeding default booking form fields...");
    
    // Extracted from booking schema and forms
    const fields = [
      { fieldName: "civility", label: "Civility/Title", fieldType: "select", section: "personal" },
      { fieldName: "firstName", label: "First Name", fieldType: "text", section: "personal", required: true },
      { fieldName: "lastName", label: "Last Name", fieldType: "text", section: "personal", required: true },
      { fieldName: "fullName", label: "Full Name (as in Passport)", fieldType: "text", section: "personal" },
      { fieldName: "dateOfBirth", label: "Date of Birth", fieldType: "date", section: "personal", required: true },
      { fieldName: "gender", label: "Gender", fieldType: "select", section: "personal", required: true },
      { fieldName: "nationality", label: "Nationality", fieldType: "text", section: "personal" },
      { fieldName: "placeOfBirth", label: "Place of Birth", fieldType: "text", section: "personal" },
      { fieldName: "ethnicGroup", label: "Ethnic Group", fieldType: "text", section: "personal" },
      { fieldName: "maritalStatus", label: "Marital Status", fieldType: "select", section: "personal" },
      { fieldName: "levelOfStudy", label: "Level of Study", fieldType: "select", section: "personal" },
      { fieldName: "occupation", label: "Occupation", fieldType: "text", section: "personal" },
      
      { fieldName: "email", label: "Email Address", fieldType: "email", section: "contact" },
      { fieldName: "phone", label: "Phone Number", fieldType: "tel", section: "contact", required: true },
      { fieldName: "country", label: "Country of Residence", fieldType: "text", section: "contact" },
      { fieldName: "city", label: "City", fieldType: "text", section: "contact" },
      { fieldName: "address", label: "Residential Address", fieldType: "text", section: "contact" },
      
      { fieldName: "passportNumber", label: "Passport Number", fieldType: "text", section: "passport" },
      { fieldName: "passportIssueDate", label: "Passport Issue Date", fieldType: "date", section: "passport" },
      { fieldName: "passportExpiry", label: "Passport Expiry Date", fieldType: "date", section: "passport" },
      { fieldName: "passportIssuingAuthority", label: "Issuing Authority", fieldType: "text", section: "passport" },
      
      { fieldName: "fathersName", label: "Father's Name", fieldType: "text", section: "family" },
      { fieldName: "mothersName", label: "Mother's Name", fieldType: "text", section: "family" },
      { fieldName: "mahramName", label: "Mahram Name", fieldType: "text", section: "family" },
      { fieldName: "mahramRelationship", label: "Mahram Relationship", fieldType: "text", section: "family" },
      { fieldName: "mahramPassport", label: "Mahram Passport Number", fieldType: "text", section: "family" },
      
      { fieldName: "meningitisVaccineDate", label: "Meningitis Vaccine Date", fieldType: "date", section: "health" },
      { fieldName: "previousUmrah", label: "Performed Umrah/Hajj before?", fieldType: "boolean", section: "health" },
      { fieldName: "previousUmrahYear", label: "Year of Last Umrah/Hajj", fieldType: "number", section: "health" },
      
      { fieldName: "emergencyContactName", label: "Emergency Contact Name", fieldType: "text", section: "emergency" },
      { fieldName: "emergencyContactPhone", label: "Emergency Contact Phone", fieldType: "tel", section: "emergency" },
      { fieldName: "emergencyContactRelationship", label: "Emergency Contact Relationship", fieldType: "text", section: "emergency" },
      
      { fieldName: "departureCity", label: "Departure City", fieldType: "select", section: "preferences" },
      { fieldName: "roomPreference", label: "Room Preference", fieldType: "select", section: "preferences" },
      { fieldName: "specialRequests", label: "Special Requests / Observations", fieldType: "textarea", section: "preferences" },
      
      { fieldName: "passportCopyUrl", label: "Passport Data Page Upload", fieldType: "file", section: "documents" },
      { fieldName: "profilePhotoUrl", label: "Passport Photograph Upload", fieldType: "file", section: "documents" }
    ];

    await db.insert(bookingFormFieldsTable).values(
      fields.map((f, i) => ({
        ...f,
        enabled: true,
        isSystem: true,
        sortOrder: i * 10
      }))
    );
  }
}
