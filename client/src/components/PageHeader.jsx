
const PageSectionHeader = ({ title, subtitle }) => {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-teal-700/40 bg-gradient-to-r from-teal-700 to-emerald-600 p-5 shadow-sm shadow-teal-900/10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-sm text-emerald-50">{subtitle}</p>}
      </div>
    </div>
  );
};

const PageHeader = ({ title, subtitle }) => {
  return <PageSectionHeader title={title} subtitle={subtitle} />;
};

export { PageSectionHeader };
export default PageHeader;
