import SettingsLayout from "@/layouts/SettingsLayout";
import { useTranslation } from "next-i18next";
import getServerSideProps from "@/lib/client/getServerSideProps";

export default function Worker() {
	const { t } = useTranslation();

	return (
		<SettingsLayout>
			<p className="capitalize text-3xl font-thin inline">
				{t("worker")}
			</p>

			<div className="divider my-3"></div>

			<div className="w-full flex flex-col gap-6 justify-between">
				<div className="flex flex-col sm:flex-row sm:items-center gap-3">
					<span>{t("regenerate_broken_preservations")}</span>
					<button
						className={`btn btn-sm ml-auto btn-accent dark:border-violet-400 text-white tracking-wider w-fit flex items-center gap-2`}
					>
						{t("confirm")}
					</button>
				</div>
				<div className="flex flex-col sm:flex-row sm:items-center gap-3">
					<span>{t("delete_all_preservations")}</span>
					<button
						className={`btn btn-sm ml-auto btn-accent dark:border-violet-400 text-white tracking-wider w-fit flex items-center gap-2`}
					>
						{t("confirm")}
					</button>
				</div>
				<div className="flex flex-col sm:flex-row sm:items-center gap-3">
					<span>{t("delete_all_preservations_and_regenerate")}</span>
					<button
						className={`btn btn-sm ml-auto btn-accent dark:border-violet-400 text-white tracking-wider w-fit flex items-center gap-2`}
					>
						{t("confirm")}
					</button>
				</div>
			</div>

		</SettingsLayout>
	);
}

export { getServerSideProps };
