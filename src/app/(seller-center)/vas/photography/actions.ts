"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

export async function createPhotographyRequest(data: {
    itemCount: number;
    estimatedDate: string;
    notes?: string;
}) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return { success: false, error: "Usuario no autenticado" };
        }

        const request = await prisma.photographyRequest.create({
            data: {
                userId: user.id,
                itemCount: data.itemCount,
                estimatedDate: new Date(data.estimatedDate),
                notes: data.notes || "",
                status: "PENDING"
            }
        });

        revalidatePath("/vas/photography");
        return { success: true, requestId: request.id };
    } catch (error: any) {
        console.error("Photography Request Error:", error);
        return { success: false, error: error.message || "Error al procesar la solicitud" };
    }
}
