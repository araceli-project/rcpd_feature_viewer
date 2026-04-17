import pandas as pd
from sklearn.manifold import TSNE
import altair as alt
import streamlit as st

@st.cache_data
def get_chart(preprend_img_path: str, features_dict, dfy, features_to_plot: str = 'All') -> alt.Chart:

    imgname = dfy.iloc[:, 1].values
    imgname = list(map(lambda x: preprend_img_path + x, imgname))
    colors = dfy.iloc[:, -1].values

    features_to_plot_values = features_dict[features_to_plot]

    tsne_features = TSNE(n_components=2, random_state=42).fit_transform(features_to_plot_values)
    st.session_state['features_dict_pca'][features_to_plot] = tsne_features

    tsne_df = pd.DataFrame(data=tsne_features, columns=['x', 'y'])
    tsne_df['image'] = imgname
    tsne_df['color'] = colors

    chart = alt.Chart(tsne_df).mark_circle(size=30).encode(
        x="x",
        y="y",
        color=alt.Color('color:N', scale=alt.Scale(scheme='lightgreyred')),
        tooltip=['image']
    ).add_params(alt.selection_interval()).configure_view(strokeWidth=0)

    return chart

def bars_csai_amount(dfy) -> alt.Chart:
    csai_amount = dfy['csam'].value_counts()
    
    print(csai_amount)
    csai_df = csai_amount.reset_index()
    csai_df.columns = ['csam', 'amount']
    
    chart = alt.Chart(csai_df).mark_bar().encode(
        x=alt.X('csam'),
        y=alt.Y('amount'),
        color=alt.Color('csam', scale=alt.Scale(scheme='lightgreyred'))
    )
    return chart