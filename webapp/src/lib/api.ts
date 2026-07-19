const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type Section = {
	id: number;
	section_name: string;
	year: number;
};

export async function fetchSections(year?: number): Promise<Section[]> {
	const url = new URL("/sections/", API_BASE_URL);
	if (year !== undefined) {
		url.searchParams.set("year", String(year));
	}

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch sections: ${res.status}`);
	}
	return res.json();
}

export type Session = {
	day: string;
	period_number: number;
	start_time: string;
	course_code: string;
	course_name: string | null;
	faculty_name: string;
	room_number: string;
	section: string;
};

export type Timetable = {
	sections_requested: string[];
	sessions: Session[];
};

export async function fetchTimetable(sectionIds: number[]): Promise<Timetable> {
	const url = new URL("/timetable/", API_BASE_URL);
	for (const id of sectionIds) {
		url.searchParams.append("section_id", String(id));
	}

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch timetable: ${res.status}`);
	}
	return res.json();
}

export type Announcement = {
	id: number;
	title: string;
	body: string;
	link_label: string | null;
	link_url: string | null;
	created_at: string;
};

export async function fetchCurrentAnnouncement(): Promise<Announcement | null> {
	const url = new URL("/announcements/current", API_BASE_URL);

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch current announcement: ${res.status}`);
	}
	return res.json();
}

export type RollNumberMappingOut = {
	roll_no: string;
	academic_year: number;
	sections: Section[];
};

export async function fetchRollNumberMapping(
	rollNo: string,
): Promise<RollNumberMappingOut> {
	const url = new URL(`/api/roll-numbers/${rollNo}`, API_BASE_URL);
	const res = await fetch(url);
	if (!res.ok) {
		const detail = `Failed to fetch roll number mapping: ${res.status}`;
		let detailMessage = "";
		try {
			const body = await res.json();
			if (body?.detail) {
				detailMessage = body.detail;
			}
		} catch {}
		const error = new Error(detailMessage || detail);
		(error as any).status = res.status;
		(error as any).detail = detailMessage;
		throw error;
	}
	return res.json();
}

export async function sendOtp(
	rollNo: string,
	sectionIds: number[],
): Promise<{ status: string; message: string }> {
	const url = new URL("/api/auth/otp/send", API_BASE_URL);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ roll_no: rollNo, section_ids: sectionIds }),
	});
	if (!res.ok) {
		let detailMessage = "";
		try {
			const body = await res.json();
			if (body?.detail) {
				detailMessage = body.detail;
			}
		} catch {}
		const error = new Error(
			detailMessage || `Failed to send OTP: ${res.status}`,
		);
		(error as any).status = res.status;
		throw error;
	}
	return res.json();
}

export async function verifyOtp(
	rollNo: string,
	otpCode: string,
): Promise<RollNumberMappingOut> {
	const url = new URL("/api/auth/otp/verify", API_BASE_URL);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ roll_no: rollNo, otp_code: otpCode }),
	});
	if (!res.ok) {
		let detailMessage = "";
		try {
			const body = await res.json();
			if (body?.detail) {
				detailMessage = body.detail;
			}
		} catch {}
		const error = new Error(
			detailMessage || `Failed to verify OTP: ${res.status}`,
		);
		(error as any).status = res.status;
		throw error;
	}
	return res.json();
}

export function formatTime(time: string): string {
	// time comes as "HH:MM:SS" from the API
	const [hours, minutes] = time.split(":").map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}
